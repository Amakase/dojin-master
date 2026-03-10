class Admin::EventFloorPlansController < Admin::BaseController
  before_action :set_event

  def index
    @floor_plans = @event.event_floor_plans
    @new_floor_plan = EventFloorPlan.new
  end

  def create
    @floor_plan = @event.event_floor_plans.build(floor_plan_params)
    @floor_plan.position = @event.event_floor_plans.count
    if @floor_plan.save
      redirect_to admin_event_floor_plans_path(@event), notice: "Section added."
    else
      @floor_plans = @event.event_floor_plans
      @new_floor_plan = @floor_plan
      render :index, status: :unprocessable_entity
    end
  end

  def destroy
    @event.event_floor_plans.find(params[:id]).destroy
    redirect_to admin_event_floor_plans_path(@event), notice: "Section deleted."
  end

  private

  def set_event = @event = Event.find(params[:event_id])
  def floor_plan_params = params.require(:event_floor_plan).permit(:name, :image, :position)
end
