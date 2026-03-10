# Handles the Fabric.js floor plan editor for a single floor plan section.
# Admins draw rectangles over a floor plan PNG and label each with a booth_space string.
# Coordinates are stored as percentages of the image dimensions so they scale correctly
# at any display size.
class Admin::MapEditorsController < Admin::BaseController
  before_action :set_event_and_floor_plan

  # Renders the map editor page. Passes existing coordinates and booth spaces
  # as instance variables so the view can embed them as data attributes for
  # the Stimulus controller to consume on load.
  def show
    # Serialise existing coordinates (scoped to this section) for the Stimulus controller
    @existing_coords = @floor_plan.event_map_coordinates.map do |c|
      { booth_space: c.booth_space, x: c.x, y: c.y, width: c.width, height: c.height }
    end

    # Sidebar: globally unplaced + already placed in this section
    all_placed     = @event.event_map_coordinates.pluck(:booth_space).to_set
    section_placed = @floor_plan.event_map_coordinates.pluck(:booth_space).to_set
    available      = @event.booths.pluck(:booth_space).compact.uniq.sort
    @booth_spaces  = available.select { |bs| !all_placed.include?(bs) || section_placed.include?(bs) }
  end

  # Replaces all coordinates for this floor plan section with the submitted set.
  # Uses a full-replace strategy (delete_all + recreate) rather than diffing the
  # existing records — simpler and keeps the DB in sync with exactly what the
  # admin sees on the canvas.
  def update
    @event.transaction do
      @floor_plan.event_map_coordinates.delete_all

      if params[:coordinates].present?
        coord_list = params.expect(coordinates: [[:booth_space, :x, :y, :width, :height]])
        coord_list.each do |cp|
          @floor_plan.event_map_coordinates.create!(
            event_id:    @event.id,
            booth_space: cp[:booth_space],
            x:  cp[:x].to_f,
            y:  cp[:y].to_f,
            width:  cp[:width].to_f,
            height: cp[:height].to_f
          )
        end
      end
    end

    render json: { status: "ok" }
  rescue ActiveRecord::RecordInvalid, ActiveRecord::StatementInvalid => e
    render json: { status: "error", message: e.message }, status: :unprocessable_entity
  end

  private

  def set_event_and_floor_plan
    @event      = Event.find(params[:event_id])
    @floor_plan = @event.event_floor_plans.find(params[:floor_plan_id])
  rescue ActiveRecord::RecordNotFound
    render json: { status: "error", message: "Record not found." }, status: :not_found
  end
end
