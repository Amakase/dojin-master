class Circle < ApplicationRecord
  has_many :booths, dependent: :destroy
  has_many :events, through: :booths
  # has_many :booth_works, through: :booths
  # has_many :favorites, through: :booths
  has_many :notifications, through: :booths
  has_many :circle_works, dependent: :destroy
  has_many :works, through: :circle_works
  has_one_attached :image

  validates :name, presence: true
  validates :name_reading, presence: true, format: { with: /\A[ァ-ヿ]+\z/, message: "must be full-width katakana" }
  # validates :description, presence: true, allow_blank: true
end
