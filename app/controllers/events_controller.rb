class EventsController < ApplicationController
  def index
    @filter = params[:filter].presence

    if @filter == "bookmarked"
      @events = policy_scope(current_user.events)
    else
      @events = policy_scope(Event)
    end

    if params[:query].present?
      sql_subquery = <<~SQL
        events.name ILIKE :query
        OR events.venue ILIKE :query
        OR events.description ILIKE :query
        OR CAST(events.start_date AS TEXT) ILIKE :query
        OR CAST(events.end_date AS TEXT) ILIKE :query
      SQL

      @events = @events.where(sql_subquery, query: "%#{params[:query]}%")
    end

    respond_to do |format|
      format.html
      format.turbo_stream
    end
  end

  def show
    # @notification = Notification.where(id: :booth_id)
    @event = policy_scope(Event).find(params[:id])
    authorize @event, :show?

    # load booths once (with images preloaded); subsequent searches filter the Ruby array
    @booths = Rails.cache.fetch(cache_key_for(@event)) do
      @event.booths
            .joins(:circle)
            .includes({ image_attachment: :blob },
                      circle: { image_attachment: :blob })
            .to_a
    end

    if params[:query].present?
      q = params[:query].downcase
      @booths = @booths.select do |b|
        b.genre&.downcase&.include?(q) ||
          b.booth_space&.downcase&.include?(q) ||
          b.description&.downcase&.include?(q) ||
          b.booth_day.to_s.include?(q) ||
          b.circle.name.downcase.include?(q)
      end
    end

    # Bulk-load per-user data in 2 SQL regardless of booth count
    booth_ids = @booths.map(&:id)
    @favorites_by_booth_id = current_user.favorites
                                         .where(booth_id: booth_ids)
                                         .index_by(&:booth_id)
    @prioritized_booth_ids = @favorites_by_booth_id
                             .each_with_object(Set.new) { |(id, f), s| s << id unless f.priority.nil? }
    # which booths have at least one unread (new) notification (controls badge visibility)
    @notified_booth_ids  = Notification
                           .where(booth_id: booth_ids, read: false)
                           .pluck(:booth_id).to_set
    # count only unread (new) notifications per booth
    @notification_counts = Notification
                           .where(booth_id: booth_ids, read: false)
                           .group(:booth_id)
                           .count
  end

  private

  # key used for caching an event's booth list
  # increment version suffix when the preloaded associations change
  def cache_key_for(event)
    ["event", event.id, "booths_v2"]
  end

  def skip_pundit?
    devise_controller? || params[:controller] =~ /(^(rails_)?admin)|(^pages$)/
  end
end
