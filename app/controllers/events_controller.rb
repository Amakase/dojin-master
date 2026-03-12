class EventsController < ApplicationController
  ALL_LAYOUT_PAGE_SIZE = 75
  FIXED_RECOMMENDED_CIRCLE_NAME = "Neotopia Sounds"

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

    if user_signed_in?
      event_ids = @events.pluck(:id)
      @bookmarked_events_by_event_id = current_user.bookmarked_events
                                                   .where(event_id: event_ids)
                                                   .index_by(&:event_id)
    end

    respond_to do |format|
      format.html
      format.turbo_stream
    end
  end

  def show
    @event = policy_scope(Event).find(params[:id])
    authorize @event, :show?

    load_booths if request.headers["Turbo-Frame"] == "booths_frame" ||
                   request.format.turbo_stream?

    return render("load_more_booths", formats: :turbo_stream) if append_booths_request?
  end

  private

  def load_booths
    @layout_mode = %w[rows all].include?(params[:layout]) ? params[:layout] : "rows"
    @quick_filter = if user_signed_in? && %w[favorites
                                             inventory].include?(params[:quick_filter])
                      params[:quick_filter]
                    else
                      nil
                    end

    booths_scope = Booth
                   .where(id: event_booth_ids)
                   .includes({ image_attachment: :blob },
                             circle: { image_attachment: :blob })

    booths_scope = apply_search_filter(booths_scope)
    booths_scope = apply_booth_filter(booths_scope)
    booths_scope = apply_quick_filter(booths_scope)

    sorted_booths = sort_booths(booths_scope.load)
    @booths_total_count = sorted_booths.size
    @unread_notifications_total = if user_signed_in?
                                    prioritized_booth_ids = current_user.favorites
                                                                        .where(priority: 1..9, booth_id: event_booth_ids)
                                                                        .select(:booth_id)

                                    Notification.where(booth_id: prioritized_booth_ids, read: false).count
                                  else
                                    0
                                  end

    if @layout_mode == "rows"
      prepare_row_layout(sorted_booths)
    else
      prepare_all_layout(sorted_booths)
    end
  end

  def event_booth_ids
    @event_booth_ids ||= Rails.cache.fetch(cache_key_for(@event)) do
      @event.booths
            .joins(:circle)
            .distinct
            .pluck(:id)
    end
  end

  def apply_search_filter(scope)
    return scope unless params[:query].present?

    query = "%#{ActiveRecord::Base.sanitize_sql_like(params[:query].to_s.downcase)}%"

    scope.joins(:circle).where(
      <<~SQL.squish,
        LOWER(COALESCE(booths.genre, '')) LIKE :query
        OR LOWER(COALESCE(booths.booth_space, '')) LIKE :query
        OR LOWER(COALESCE(booths.description, '')) LIKE :query
        OR CAST(booths.booth_day AS TEXT) LIKE :query
        OR LOWER(COALESCE(circles.name, '')) LIKE :query
      SQL
      query: query
    )
  end

  def apply_booth_filter(scope)
    return scope unless params[:filter_by].present?

    filter = params[:filter_by]

    apply_relation_filter(scope, filter)
  end

  def apply_relation_filter(scope, filter)
    if filter.start_with?("space:")
      prefix = "#{ActiveRecord::Base.sanitize_sql_like(filter.delete_prefix('space:'))}%"
      scope.where("booths.booth_space LIKE ?", prefix)
    elsif filter == "inventory"
      circle_ids = inventory_circle_ids
      circle_ids.empty? ? scope.none : scope.where(circle_id: circle_ids)
    else
      scope.where(genre: filter)
    end
  end

  def apply_quick_filter(scope)
    return scope unless @quick_filter.present?

    case @quick_filter
    when "inventory"
      circle_ids = inventory_circle_ids
      circle_ids.empty? ? scope.none : scope.where(circle_id: circle_ids)
    when "favorites"
      scope.where(id: current_user.favorites.select(:booth_id))
    else
      scope
    end
  end

  def inventory_circle_ids
    return [] unless user_signed_in?

    @inventory_circle_ids ||= current_user.works
                                          .joins(:circle_works)
                                          .distinct
                                          .pluck("circle_works.circle_id")
  end

  def sort_booths(booths)
    booths.sort_by do |booth|
      booth_space = booth.booth_space.to_s

      if booth_space.include?("カタログ")
        [1, Date.new(9999), "", 999, ""]
      else
        day = booth.booth_day || Date.new(9999, 12, 31)

        if (match = booth_space.match(/\A([A-Za-z]+)-(\d+)([a-zA-Z]*)\z/))
          [0, day, match[1].upcase, match[2].to_i, match[3].downcase]
        else
          [0, day, booth_space, 0, ""]
        end
      end
    end
  end

  def prepare_row_layout(sorted_booths)
    @booths = sorted_booths
    @all_booths_next_page = nil
    @all_booths_request_params = nil

    load_recommendation_state(@booths.map(&:id))
    @booth_rows = build_booth_rows(@booths)

    visible_booth_ids = @booth_rows.flat_map { |row| row[:booths].map(&:id) }.uniq
    load_visible_booth_state(visible_booth_ids)
  end

  def prepare_all_layout(sorted_booths)
    @booth_rows = []
    @favorite_counts_by_booth_id = {}
    @all_booths_page = [params[:page].to_i, 1].max

    offset = (@all_booths_page - 1) * ALL_LAYOUT_PAGE_SIZE

    @booths = sorted_booths.slice(offset, ALL_LAYOUT_PAGE_SIZE) || []
    @all_booths_next_page = offset + ALL_LAYOUT_PAGE_SIZE < @booths_total_count ? @all_booths_page + 1 : nil
    @all_booths_request_params = request.query_parameters.symbolize_keys.except(:page, :append, :format)

    if user_signed_in?
      @favorites_by_booth_id = current_user.favorites.where(booth_id: @booths.map(&:id)).index_by(&:booth_id)
    else
      @favorites_by_booth_id = {}
    end

    load_visible_booth_state(@booths.map(&:id))
  end

  def load_recommendation_state(booth_ids)
    @favorite_counts_by_booth_id = Favorite
                                   .where(booth_id: booth_ids)
                                   .group(:booth_id)
                                   .count

    if user_signed_in?
      @favorites_by_booth_id = current_user.favorites.where(booth_id: booth_ids).index_by(&:booth_id)
    else
      @favorites_by_booth_id = {}
    end
  end

  def load_visible_booth_state(visible_booth_ids)
    if visible_booth_ids.empty? || !user_signed_in?
      @prioritized_booth_ids = {}
      @notification_counts = {}
      return
    end

    visible_favorites = @favorites_by_booth_id.slice(*visible_booth_ids)
    @prioritized_booth_ids = visible_favorites.each_with_object({}) do |(booth_id, favorite), prioritized|
      prioritized[booth_id] = true if favorite.priority.to_i.between?(1, 9)
    end
    @notification_counts = Notification
                           .where(booth_id: visible_booth_ids, read: false)
                           .group(:booth_id)
                           .count
  end

  def build_booth_rows(booths)
    all_booths = booths.to_a.uniq(&:id)
    return [] if all_booths.empty?

    user_favorited_booths = all_booths.select { |booth| @favorites_by_booth_id.key?(booth.id) }
    user_favorited_genres = user_favorited_booths.filter_map(&:genre)
    user_favorited_ids = user_favorited_booths.map(&:id).to_set
    seen_ids = [].to_set
    random_row = -> { take_row_booths(all_booths.shuffle, fallback: all_booths, seen_ids: seen_ids) }

    recommended_row_booths = if user_favorited_genres.any?
                               take_row_booths(recommended_booths(all_booths, user_favorited_genres),
                                               fallback: all_booths,
                                               seen_ids: seen_ids)
                             else
                               random_row.call
                             end

    recommended_row_booths = with_fixed_recommended_booth(recommended_row_booths, all_booths, seen_ids)

    rows = []
    rows << { title: "Recommended For You", booths: recommended_row_booths }

    if user_favorited_genres.any?
      rows << {
        title: "Because You Favorited",
        booths: take_row_booths(similar_genre_booths(all_booths, user_favorited_genres, user_favorited_ids),
                                fallback: all_booths, seen_ids: seen_ids)
      }
      rows << {
        title: "Trending Now",
        booths: take_row_booths(trending_booths(all_booths), fallback: all_booths, seen_ids: seen_ids)
      }
    else
      rows << { title: "Because You Favorited", booths: random_row.call }
      rows << { title: "Trending Now", booths: random_row.call }
    end

    rows.concat([
                  {
                    title: "Random Discovery",
                    booths: take_row_booths(mixed_genre_booths(all_booths), fallback: all_booths, seen_ids: seen_ids)
                  },
                  {
                    title: "Music Booths",
                    booths: take_row_booths(category_booths(all_booths, "［音楽］"), fallback: all_booths,
                                                                                 seen_ids: seen_ids)
                  },
                  {
                    title: "Anime / Game Booths",
                    booths: take_row_booths(category_booths(all_booths, "［アニメ・ゲーム］"), fallback: all_booths,
                                                                                      seen_ids: seen_ids)
                  },
                  {
                    title: "VTuber / Creator",
                    booths: take_row_booths(
                      all_booths.select { |booth| booth.genre == "［マルチメディア］YouTuber/VTuber" }.shuffle,
                      fallback: all_booths,
                      seen_ids: seen_ids
                    )
                  },
                  {
                    title: "Hidden Gems",
                    booths: take_row_booths(hidden_gem_booths(all_booths), fallback: all_booths, seen_ids: seen_ids)
                  },
                  {
                    title: "New Booths",
                    booths: take_row_booths(new_booths(all_booths), fallback: all_booths, seen_ids: seen_ids)
                  },
                  {
                    title: "Explore More",
                    booths: take_row_booths(mixed_genre_booths(all_booths.shuffle), fallback: all_booths,
                                                                                    seen_ids: seen_ids)
                  }
                ])

    rows
  end

  def with_fixed_recommended_booth(recommended_row_booths, all_booths, seen_ids)
    fixed_booth = all_booths.find { |booth| booth.circle&.name == FIXED_RECOMMENDED_CIRCLE_NAME }
    return recommended_row_booths unless fixed_booth

    updated_booths = recommended_row_booths.reject { |booth| booth.id == fixed_booth.id }
    updated_booths << fixed_booth
    seen_ids.add(fixed_booth.id)
    updated_booths
  end

  def take_row_booths(primary_pool, fallback:, seen_ids:, count: 20)
    selected = unique_booths(primary_pool, seen_ids: seen_ids, count: count)

    if selected.size < count
      remaining_ids = seen_ids | selected.map(&:id).to_set
      selected += unique_booths(fallback, seen_ids: remaining_ids, count: count - selected.size)
    end

    seen_ids.merge(selected.map(&:id))
    selected
  end

  def unique_booths(pool, seen_ids:, count:)
    Array(pool)
      .compact
      .uniq(&:id)
      .reject { |booth| seen_ids.include?(booth.id) }
      .first(count)
  end

  def recommended_booths(booths, user_favorited_genres)
    top_genre = user_favorited_genres.tally.max_by { |_genre, count| count }&.first
    genre_matches = booths.select { |booth| booth.genre == top_genre }.shuffle
    top_booths = booths.sort_by { |booth| -favorite_count_for(booth) }.first(40)

    (genre_matches + top_booths).uniq(&:id)
  end

  def similar_genre_booths(booths, user_favorited_genres, user_favorited_ids)
    booths
      .select { |booth| user_favorited_genres.include?(booth.genre) && !user_favorited_ids.include?(booth.id) }
      .shuffle
  end

  def trending_booths(booths)
    booths.sort_by do |booth|
      [-favorite_count_for(booth), -booth.created_at.to_i]
    end
  end

  def category_booths(booths, category_prefix)
    booths.select { |booth| booth.genre.to_s.start_with?(category_prefix) }.shuffle
  end

  def hidden_gem_booths(booths)
    booths
      .select do |booth|
        favorite_count_for(booth) < 3 &&
          (booth.description.present? || booth.image.attached? || booth.circle.image.attached?)
      end
      .sort_by { |booth| [-favorite_count_for(booth), -booth.description.to_s.length] }
  end

  def new_booths(booths)
    booths.sort_by { |booth| -booth.created_at.to_i }
  end

  def mixed_genre_booths(booths)
    groups = booths.group_by { |booth| booth.genre.presence || "Other" }
                   .transform_values(&:shuffle)
    ordered = []

    loop do
      added = false

      groups.keys.shuffle.each do |genre|
        next if groups[genre].blank?

        ordered << groups[genre].shift
        added = true
      end

      break unless added
    end

    ordered
  end

  def favorite_count_for(booth)
    @favorite_counts_by_booth_id[booth.id].to_i
  end

  def append_booths_request?
    request.format.turbo_stream? && params[:append] == "booths" && @layout_mode == "all"
  end

  def cache_key_for(event)
    ["event", event.id, "booths_v2"]
  end

  def skip_pundit?
    devise_controller? || params[:controller] =~ /(^(rails_)?admin)|(^pages$)/
  end
end
