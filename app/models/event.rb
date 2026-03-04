class Event < ApplicationRecord
  has_many :bookmarked_events, dependent: :destroy
  # has_many :users, through: :bookmarked_events
  has_many :booths, dependent: :destroy
  has_many :circles, through: :booths
  # has_many :booth_works, through: :booths
  # has_many :notifications, through: :booths
  has_one_attached :image

  validates :name, presence: true, uniqueness: true
  validates :venue, presence: true
  validates :description, presence: true, allow_blank: true
  validates :start_date, presence: true
  validates :end_date, presence: true
end
