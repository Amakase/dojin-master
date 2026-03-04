class EventsController < ApplicationController
  before_action :authenticate_user!
  include Pundit::Authorization

  after_action :verify_authorized, except: :index, unless: :skip_pundit?
  after_action :verify_policy_scoped, only: :index, unless: :skip_pundit?

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

  private

  def skip_pundit?
    devise_controller? || params[:controller] =~ /(^(rails_)?admin)|(^pages$)/
  end
end
