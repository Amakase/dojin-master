class BoothsController < ApplicationController
  def index; end

  def show
    @booth = Booth.find(params[:id])
    authorize @booth

    @event = @booth.event
    @notifications = @booth.notifications
    @booth_works = @booth.booth_works
    @user_inventory = current_user.collections.first.collection_works
  end
end
