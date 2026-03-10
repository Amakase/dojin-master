class Admin::FloorPlanAiPlacementsController < Admin::BaseController
  before_action :set_event_and_floor_plan

  def create
    unless @floor_plan.image.attached?
      @no_floor_plan = true
      return respond_to { |f| f.turbo_stream; f.html { redirect_to admin_event_floor_plan_map_editor_path(@event, @floor_plan) } }
    end

    @floor_plan.update!(ai_placement_status: "pending", ai_placement_error: nil)
    AiBoothPlacementJob.perform_later(@floor_plan.id)

    respond_to { |f| f.turbo_stream; f.html { redirect_to admin_event_floor_plan_map_editor_path(@event, @floor_plan) } }
  end

  private

  def set_event_and_floor_plan
    @event      = Event.find(params[:event_id])
    @floor_plan = @event.event_floor_plans.find(params[:floor_plan_id])
  end
end
