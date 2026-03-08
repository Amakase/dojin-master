class BookmarkedEventsController < ApplicationController
  before_action :set_event

  def create
    @bookmarked_event = current_user.bookmarked_events.new(event: @event)
    authorize @bookmarked_event

    @bookmarked_event.save

    respond_with_bookmark
  end

  def destroy
    @bookmarked_event = current_user.bookmarked_events.find_by!(event: @event)
    authorize @bookmarked_event

    @bookmarked_event.destroy

    respond_with_bookmark
  end

  private

  def set_event
    @event = Event.find(params[:event_id])
  end

  def respond_with_bookmark
    respond_to do |format|
      format.turbo_stream { render :bookmark }
      format.html { redirect_to events_path }
    end
  end
end
