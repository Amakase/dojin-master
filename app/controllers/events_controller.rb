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

    event_booth_ids = Rails.cache.fetch(cache_key_for(@event)) do
      @event.booths
            .joins(:circle)
            .pluck(:id)
    end

    @booths = Booth
              .where(id: event_booth_ids)
              .includes({ image_attachment: :blob },
                        circle: { image_attachment: :blob })

    apply_search_filter
    apply_booth_filter
    apply_quick_filter(event_booth_ids)
    sort_booths!
    load_user_booth_state

    @booth_rows = build_booth_rows(@booths) if @layout_mode == "rows"
  end

  def apply_search_filter
    return unless params[:query].present?

    query = params[:query].downcase

    @booths = @booths.select do |booth|
      booth.genre&.downcase&.include?(query) ||
        booth.booth_space&.downcase&.include?(query) ||
        booth.description&.downcase&.include?(query) ||
        booth.booth_day.to_s.include?(query) ||
        booth.circle.name.downcase.include?(query)
    end
  end

  def apply_booth_filter
    return unless params[:filter_by].present?

    filter = params[:filter_by]

    if @booths.is_a?(ActiveRecord::Relation)
      apply_relation_filter(filter)
    else
      apply_array_filter(filter)
    end
  end

  def apply_relation_filter(filter)
    if filter.start_with?("space:")
      prefix = filter.delete_prefix("space:")
      @booths = @booths.where("booth_space LIKE ?", "#{prefix}%")
    elsif filter == "inventory"
      @booths = @booths.where(circle_id: inventory_circle_ids)
    else
      @booths = @booths.where(genre: filter)
    end
  end

  def apply_array_filter(filter)
    if filter.start_with?("space:")
      prefix = filter.delete_prefix("space:")
      @booths = @booths.select { |booth| booth.booth_space&.start_with?(prefix) }
    elsif filter == "inventory"
      visible_circle_ids = inventory_circle_ids.to_set
      @booths = @booths.select { |booth| visible_circle_ids.include?(booth.circle_id) }
    else
      @booths = @booths.select { |booth| booth.genre == filter }
    end
  end

  def apply_quick_filter(event_booth_ids)
    return unless @quick_filter.present?

    case @quick_filter
    when "inventory"
      if @booths.is_a?(ActiveRecord::Relation)
        @booths = @booths.where(circle_id: inventory_circle_ids)
      else
        visible_circle_ids = inventory_circle_ids.to_set
        @booths = @booths.select { |booth| visible_circle_ids.include?(booth.circle_id) }
      end
    when "favorites"
      favorite_booth_ids = current_user.favorites.where(booth_id: event_booth_ids).pluck(:booth_id)

      if @booths.is_a?(ActiveRecord::Relation)
        @booths = @booths.where(id: favorite_booth_ids)
      else
        visible_favorite_ids = favorite_booth_ids.to_set
        @booths = @booths.select { |booth| visible_favorite_ids.include?(booth.id) }
      end
    end
  end

  def inventory_circle_ids
    @inventory_circle_ids ||= current_user.works
                                          .joins(:circle_works)
                                          .pluck("circle_works.circle_id")
  end

  def sort_booths!
    @booths = @booths.sort_by do |booth|
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

  def load_user_booth_state
    visible_booth_ids = @booths.map(&:id)

    @favorite_counts_by_booth_id = Favorite
                                   .where(booth_id: visible_booth_ids)
                                   .group(:booth_id)
                                   .count

    unless user_signed_in?
      @favorites_by_booth_id = {}
      @prioritized_booth_ids = []
      @notified_booth_ids = []
      @notification_counts = {}
      return
    end

    @favorites_by_booth_id = current_user.favorites
                                         .where(booth_id: visible_booth_ids)
                                         .index_by(&:booth_id)
    @prioritized_booth_ids = @favorites_by_booth_id
                             .filter_map { |id, favorite| id unless favorite.priority.nil? }
    @notified_booth_ids = Notification
                          .where(booth_id: visible_booth_ids, read: false)
                          .pluck(:booth_id)
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

    rows = []
    if user_favorited_genres.any?
      rows << {
        title: "Recommended For You",
        booths: take_row_booths(recommended_booths(all_booths, user_favorited_genres), fallback: all_booths,
                                                                                       seen_ids: seen_ids)
      }
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
      rows << { title: "Recommended For You", booths: random_row.call }
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

  def cache_key_for(event)
    ["event", event.id, "booths_v2"]
  end

  def skip_pundit?
    devise_controller? || params[:controller] =~ /(^(rails_)?admin)|(^pages$)/
  end
end
