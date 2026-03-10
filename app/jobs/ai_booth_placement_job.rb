# Background job that sends a floor plan section image to a vision LLM in batches
# and saves the returned booth space coordinates as EventMapCoordinate records.
# Existing manually-placed coordinates are never overwritten.
class AiBoothPlacementJob < ApplicationJob
  queue_as :default

  # Number of booth spaces sent to the LLM per call.
  # Smaller = more accurate per call, more API calls total.
  BATCH_SIZE = 50

  def perform(floor_plan_id)
    # 1. Find the floor plan section; return early if image is not attached
    floor_plan = EventFloorPlan.find(floor_plan_id)
    event      = floor_plan.event

    return unless floor_plan.image.attached?

    # 2. Update ai_placement_status to "running"; broadcast status to admin
    floor_plan.update!(ai_placement_status: "running")
    broadcast_status(floor_plan, "running", "AI placement in process...")

    # 3. Pass the ActiveStorage attachment directly — ruby_llm handles download + encoding per batch
    attachment = floor_plan.image

    # 4. Anchor examples from this section; globally placed booth_spaces across all sections
    examples = floor_plan.event_map_coordinates.limit(20).pluck(:booth_space, :x, :y, :width, :height)
                         .map { |bs, x, y, w, h| { "booth_space" => bs, "x" => x, "y" => y, "width" => w, "height" => h } }
    placed   = event.event_map_coordinates.pluck(:booth_space)
    booths   = event.booths.pluck(:booth_space)
    unplaced = booths - placed

    # 5. Return early via finish() if nothing is unplaced
    return finish(floor_plan, 0) unless unplaced.any?

    total_placed = 0

    # 6. Iterate unplaced.each_slice(BATCH_SIZE), calling call_llm for each batch
    unplaced.each_slice(BATCH_SIZE) do |batch|
      response = call_llm(attachment, batch, examples)
      next unless response

      rows = []
      response.each do |entry|
        row = build_row(event, floor_plan, entry)
        if row
          rows << row
          total_placed += 1
        end
      end
      next unless rows.any?

      EventMapCoordinate.insert_all(rows)
    end

    # 7. Accumulate total_placed count; call finish() when all batches done
    finish(floor_plan, total_placed)

  rescue StandardError => e
    error_message = e.message
    Rails.logger.error("AiBoothPlacementJob failed: #{error_message}")
    floor_plan&.update(ai_placement_status: "failed", ai_placement_error: error_message)
    broadcast_status(floor_plan, "failed", "AI placement failed...") if floor_plan
  end

  private

  # Calls the OpenAI vision model via ruby-llm with the floor plan image and a batch of
  # booth_space labels. Returns a parsed Array of coordinate hashes, or nil on any error.
  def call_llm(attachment, batch, examples)
    chat = RubyLLM.chat(model: 'gpt-4o')
    raw  = chat.ask(build_prompt(batch, examples), with: attachment).content
    Rails.logger.debug { "AiBoothPlacementJob raw LLM response: #{raw}" }
    match = raw.match(/\[.*\]/m)
    return nil unless match
    result = JSON.parse(match[0])
    return nil unless result.is_a?(Array)
    result
  rescue StandardError => e
    Rails.logger.error("AiBoothPlacementJob#call_llm failed: #{e.message}")
    nil
  end

  def build_prompt(batch, examples)
    anchor_section = if examples.any?
      <<~ANCHORS
        The following booth spaces have already been placed correctly on this floor plan.
        Use them as spatial anchors to calibrate your coordinate estimates — they confirm
        the scale, orientation, and position of labels on the image:
        #{examples.to_json}

      ANCHORS
    else
      ""
    end

    <<~PROMPT
      You are analyzing a doujin event floor plan image.

      Your task is to locate booth spaces on the floor plan and return their bounding box coordinates.

      Coordinate system:
      - x and y are the top-left corner of the booth, as a percentage of the image width and height respectively
      - width and height are the dimensions of the booth, also as percentages of the image width and height
      - All values must be between 0.0 and 100.0
      - Origin (0, 0) is the top-left corner of the image

      #{anchor_section}Locate the following booth spaces: #{batch.to_json}

      Return ONLY a JSON array with no prose, explanation, or code fences. Each element must have exactly these keys:
      "booth_space", "x", "y", "width", "height"

      Example format:
      [{"booth_space":"A01","x":10.5,"y":20.0,"width":3.2,"height":2.1}]

      You MUST return a coordinate estimate for every booth space in the list — do not omit any.
      If you are unsure of an exact position, provide your best estimate based on the surrounding layout.
    PROMPT
  end

  # Converts one entry from the LLM JSON response into a DB row hash for insert_all.
  # Returns nil if the entry is invalid or coordinates are out of the 0–100 range.
  def build_row(event, floor_plan, entry)
    return unless entry.is_a?(Hash)
    return unless entry["booth_space"].present?

    x = entry["x"]
    y = entry["y"]
    w = entry["width"]
    h = entry["height"]

    return unless x.is_a?(Numeric) && x <= 100 && x >= 0 &&
                  y.is_a?(Numeric) && y <= 100 && y >= 0 &&
                  w.is_a?(Numeric) && w <= 100 && w > 0 &&
                  h.is_a?(Numeric) && h <= 100 && h > 0

    {
      event_id:            event.id,
      event_floor_plan_id: floor_plan.id,
      booth_space:         entry["booth_space"],
      x: x,
      y: y,
      width:  w,
      height: h,
      created_at: Time.current,
      updated_at: Time.current
    }
  end

  def finish(floor_plan, total_placed)
    floor_plan.update!(ai_placement_status: "done")
    broadcast_status(floor_plan, "done", "AI has placed #{total_placed} booths.")
  end

  def broadcast_status(floor_plan, status, message)
    Turbo::StreamsChannel.broadcast_replace_to(
      "ai_placement_floor_plan_#{floor_plan.id}",
      target: "ai-placement-status",
      partial: "admin/map_editors/ai_placement_status",
      locals: { status: status, message: message }
    )
  end
end
