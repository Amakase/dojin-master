class EventsController < ApplicationController
  def index
    @events = Event.all
  end

  def show
    @event = Event.find_by(id: params[:id])
    @booths = @event.booths.where(params[:event_id])
  end
end
