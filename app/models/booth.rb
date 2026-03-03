class Booth < ApplicationRecord
  belongs_to :event
  belongs_to :circle
  has_many :booth_works, dependent: :destroy
  has_many :favorites, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_one_attached :image

  validates :booth_day, presence: true
  validates :booth_space, presence: true
  # validates :genre, allow_blank: true
end
