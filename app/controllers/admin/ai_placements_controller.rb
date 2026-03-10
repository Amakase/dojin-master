# Receives the "AI Auto-place" button POST from the map editor.
# Validates that a floor plan is attached, enqueues the background job,
# and responds with a Turbo Stream to update the status indicator immediately.
class Admin::AiPlacementsController < Admin::BaseController
  before_action :set_event

  def create
    unless @event.floor_plan.attached?
      @no_floor_plan = true
      return respond_to { |f| f.turbo_stream; f.html { redirect_to admin_event_map_editor_path(@event) } }
    end

    @event.update!(ai_placement_status: "pending", ai_placement_error: nil)
    AiBoothPlacementJob.perform_later(@event.id)

    respond_to { |f| f.turbo_stream; f.html { redirect_to admin_event_map_editor_path(@event) } }
  end

  private

  def set_event
    @event = Event.find(params[:event_id])
  end
end
