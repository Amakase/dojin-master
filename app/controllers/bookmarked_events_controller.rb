class BookmarkedEventsController < ApplicationController
  before_action :set_event

  def create
    @bookmarked_event = current_user.bookmarked_events.new(event: @event)
    authorize @bookmarked_event

    if @bookmarked_event.save
      respond_with_bookmark
    else
      respond_to do |format|
        format.turbo_stream do
          flash.now[:alert] = @bookmarked_event.errors.full_messages.to_sentence
          render :bookmark, status: :unprocessable_entity
        end
        format.html do
          redirect_to events_path, alert: @bookmarked_event.errors.full_messages.to_sentence
        end
      end
    end
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
