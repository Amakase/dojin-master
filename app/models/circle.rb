class Circle < ApplicationRecord
  has_many :booths, dependent: :destroy
  has_many :events, through: :booths
  # has_many :booth_works, through: :booths
  # has_many :favorites, through: :booths
  has_many :notifications, through: :booths
  has_many :circle_works, dependent: :destroy
  has_many :works, through: :circle_works
  # has_one_attached :image

  validates :name, presence: true
  validates :name_reading, presence: true
  # validates :description, allow_blank: true
end
