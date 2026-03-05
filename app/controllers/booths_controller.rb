class BoothsController < ApplicationController
  def index; end

  def show
    @booth = Booth.includes(:circle, :event, image_attachment: :blob).find(params[:id])
    authorize @booth

    @event = @booth.event
    @favorite = @booth.favorites.find_by(user: current_user)
    @notifications = @booth.notifications.order(created_at: :desc)
    @booth_works = @booth.booth_works.order(:title)
    @user_inventory = current_user.collections.first.collection_works
                                  .joins(work: :circle_works)
                                  .where(circle_works: { circle_id: @booth.circle_id })
                                  .includes(:work)
  end
end
