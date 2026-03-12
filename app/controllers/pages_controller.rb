class PagesController < ApplicationController
  skip_before_action :authenticate_user!, only: [:home]

  def home
    @upcoming_events = Event.where("start_date >= ?", Date.today)
                            .order(:start_date)
                            .limit(10)
  end
end
