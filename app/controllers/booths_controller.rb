class BoothsController < ApplicationController
  def index; end

  def show
    @booth = Booth.find(params[:id])
    authorize @booth

    @event = @booth.event
    @notifications = @booth.notifications
    @booth_works = @booth.booth_works
    @user_inventory = current_user.collections.first.collection_works
                                  .joins(work: :circle_works)
                                  .where(circle_works: { circle_id: @booth.circle_id })
                                  .includes(:work)
  end
end
