class EventsController < ApplicationController
  def index
    if params[:filter] == "bookmarked"
      @events = current_user.events
    else
      @events = Event.all
    end
  end

  def show
    @event = Event.find(params[:id])
    @booths = @event.booths
  end
end
