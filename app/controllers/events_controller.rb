class EventsController < ApplicationController
  def index
    if params[:filter] == "bookmarked"
      @events = policy_scope(current_user.events)
    else
      @events = policy_scope(Event)
    end
  end

  def show
    @event = policy_scope(Event).find(params[:id])
    @booths = @event.booths
    authorize @event, :show?
  end

  private

  def skip_pundit?
    devise_controller? || params[:controller] =~ /(^(rails_)?admin)|(^pages$)/
  end
end
