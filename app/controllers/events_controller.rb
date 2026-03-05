class EventsController < ApplicationController
  def index
    @filter = params[:filter].presence

    if @filter == "bookmarked"
      @events = policy_scope(current_user.events)
    else
      @events = policy_scope(Event)
    end

    return unless params[:query].present?

    sql_subquery = <<~SQL
      events.name ILIKE :query
      OR events.venue ILIKE :query
      OR events.description ILIKE :query
      OR CAST(events.start_date AS TEXT) ILIKE :query
      OR CAST(events.end_date AS TEXT) ILIKE :query
    SQL

    @events = @events.where(sql_subquery, query: "%#{params[:query]}%")
  end

  def show
    # @notification = Notification.where(id: :booth_id)
    @event = policy_scope(Event).find(params[:id])
    @booths = @event.booths.joins(:circle).includes(:circle)
    authorize @event, :show?
    return unless params[:query].present?

    sql_subquery = <<~SQL
      booths.genre ILIKE :query
      OR booths.booth_space ILIKE :query
      OR booths.description ILIKE :query
      OR CAST(booths.booth_day AS TEXT) ILIKE :query
      OR circles.name ILIKE :query
    SQL

    @booths = @booths.where(sql_subquery, query: "%#{params[:query]}%")
  end

  private

  def skip_pundit?
    devise_controller? || params[:controller] =~ /(^(rails_)?admin)|(^pages$)/
  end
end
