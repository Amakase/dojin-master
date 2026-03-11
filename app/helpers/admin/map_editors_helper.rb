module Admin::MapEditorsHelper
  # Returns a human-readable status message for the AI placement indicator in the header.
  def ai_status_message(event)
    case event.ai_placement_status
    when "pending" then "Queued…"
    when "running" then "AI analyzing…"
    when "done"    then "Done — reload to see placements."
    when "failed"  then "Failed: #{event.ai_placement_error&.truncate(60)}"
    else ""
    end
  end
end
