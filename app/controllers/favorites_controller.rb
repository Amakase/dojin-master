class FavoritesController < ApplicationController
  before_action :set_favorite, only: [:update]
  before_action :set_booth, only: [:update]
  PER_PAGE = 15

  def index
    @event = Event.find(params[:event_id])
    @page = (params[:page] || 1).to_i
    base = policy_scope(Favorite)
             .joins(booth: :circle)
             .includes(booth: :circle)
             .where(booths: { event_id: @event.id })
             .order("favorites.visited ASC, favorites.priority ASC, circles.name_reading ASC")
    @favorites = base.limit(PER_PAGE).offset((@page - 1) * PER_PAGE)
    @has_more = base.offset(@page * PER_PAGE).exists?
  end

  def create
    @favorite = current_user.favorites.new(favorite_params)
    @booth = Booth.find(params[:booth_id])
    @favorite.booth = @booth

    authorize @favorite

    if @favorite.save
      respond_with_booth
    else
      redirect_to @booth, alert: "Already favorited."
    end
  end

  def update
    if @favorite.update(favorite_params)
      respond_with_booth
    else
      redirect_to @booth, alert: "Already favorited."
    end
  end

  private

  def respond_with_booth
    respond_to do |format|
      format.html { redirect_to @booth }
      format.turbo_stream
    end
  end

  def set_booth
    @booth = @favorite.booth
  end

  def set_favorite
    @favorite = current_user.favorites.find(params[:id])
    authorize @favorite
  end

  def favorite_params
    params.require(:favorite).permit(:priority, :notes, :visited)
  end
end
