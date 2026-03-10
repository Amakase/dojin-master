class Event < ApplicationRecord
  has_many :bookmarked_events, dependent: :destroy
  # has_many :users, through: :bookmarked_events
  has_many :booths, dependent: :destroy
  has_many :circles, through: :booths
  # has_many :booth_works, through: :booths
  # has_many :notifications, through: :booths
  has_one_attached :image                                    # poster / promotional image shown on event cards
  has_one_attached :floor_plan                               # venue map PNG used by the admin map editor
  has_many :event_map_coordinates, dependent: :destroy
  has_many :event_floor_plans, dependent: :destroy

  validates :name, presence: true, uniqueness: true
  validates :venue, presence: true
  # validates :description
  validates :start_date, presence: true
  validates :end_date, presence: true

  def dates
    starts = start_date.strftime('%b %e')
    if start_date < end_date
      "#{starts}–#{end_date.day}, #{start_date.year}"
    else
      "#{start_date.strftime('%a')} #{starts}, #{start_date.year}"
    end
  end

  def single_day?
    start_date == end_date
  end
end
