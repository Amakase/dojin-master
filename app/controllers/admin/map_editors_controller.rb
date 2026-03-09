class Admin::MapEditorsController < Admin::BaseController
  before_action :set_event

  def show
    @existing_coords = @event.event_map_coordinates.map do |c|
      { booth_space: c.booth_space, x: c.x, y: c.y, width: c.width, height: c.height }
    end
    @booth_spaces = @event.booths.pluck(:booth_space).uniq.compact.sort
  end

  def update
    @event.transaction do
      @event.event_map_coordinates.delete_all

      # params.expect raises ParameterMissing on an empty array, so only call it
      # when coordinates are actually present (clearing all rects is a valid save)
      if params[:coordinates].present?
        coords = params.expect(coordinates: [[:booth_space, :x, :y, :width, :height]])
        coords.each do |c|
          @event.event_map_coordinates.create!(
            booth_space: c[:booth_space],
            x: c[:x].to_f,
            y: c[:y].to_f,
            width: c[:width].to_f,
            height: c[:height].to_f
          )
        end
      end
    end

    render json: { status: "ok" }
  rescue ActiveRecord::RecordInvalid => e
    render json: { status: "error", message: e.message }, status: :unprocessable_entity
  end

  private

  def set_event
    @event = Event.find(params[:event_id])
  end
end
