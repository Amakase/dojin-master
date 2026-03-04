class FavoritesController < ApplicationController
  before_action :set_favorite, only: [:update]
  before_action :set_booth, only: %i[create update]
  def index
    @favorites = policy_scope(Favorite).includes(booth: :circle)
  end

  def create
    @favorite = current_user.favorites.new(favorite_params)
    @favorite.booth = @booth

    authorize @favorite

    if @favorite.save
      redirect_to @booth
    else
      redirect_to @booth, alert: @favorite.errors.full_messages.to_sentence
    end
  end

  def update
    if @favorite.update(favorite_params)
      redirect_to booth_path(@booth)
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_booth
    @booth = Booth.find(params[:booth_id])
    authorize @booth
  end

  def set_favorite
    @favorite = current_user.favorites.find(params[:id])
    authorize @favorite
  end

  def favorite_params
    params.require(:favorite).permit(:priority, :notes)
  end
end
