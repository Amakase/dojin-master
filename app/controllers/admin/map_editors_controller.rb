# Handles the Fabric.js floor plan editor for a single event.
# Admins draw rectangles over a floor plan PNG and label each with a booth_space string.
# Coordinates are stored as percentages of the image dimensions so they scale correctly
# at any display size.
class Admin::MapEditorsController < Admin::BaseController
  before_action :set_event

  def show
    # Serialise existing coordinates to JSON for the Stimulus controller to render on load
    @existing_coords = @event.event_map_coordinates.map do |coordinate|
      { booth_space: coordinate.booth_space, x: coordinate.x, y: coordinate.y, width: coordinate.width, height: coordinate.height }
    end
    # Populate the sidebar with all known booth spaces for this event
    @booth_spaces = @event.booths.pluck(:booth_space).compact.uniq.sort
  end

  def update
    @event.transaction do
      @event.event_map_coordinates.delete_all

      # params.expect raises ParameterMissing on an empty array, so only call it
      # when coordinates are actually present (clearing all rects is a valid save)
      if params[:coordinates].present?
        coord_list = params.expect(coordinates: [[:booth_space, :x, :y, :width, :height]])
        coord_list.each do |coord_params|
          @event.event_map_coordinates.create!(
            booth_space: coord_params[:booth_space],
            x: coord_params[:x].to_f,
            y: coord_params[:y].to_f,
            width: coord_params[:width].to_f,
            height: coord_params[:height].to_f
          )
        end
      end
    end

    render json: { status: "ok" }
  rescue ActiveRecord::RecordInvalid, ActiveRecord::StatementInvalid => e
    # RecordInvalid covers model-level validation failures (e.g. duplicate booth_space).
    # StatementInvalid covers DB-level constraint violations as a safety net.
    render json: { status: "error", message: e.message }, status: :unprocessable_entity
  end

  private

  def set_event
    @event = Event.find(params[:event_id])
  rescue ActiveRecord::RecordNotFound
    render json: { status: "error", message: "Event not found." }, status: :not_found
  end
end
