class BoothsController < ApplicationController
  def show
    @booth = Booth.find(params[:id])
    @event = @booth.event
    @notifications = @booth.notifications
    @booth_works = @booth.booth_works
    @user_inventory = current_user.collections.first.collection_works
  end
end
