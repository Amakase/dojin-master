class Booth < ApplicationRecord
  belongs_to :event
  belongs_to :circle

  validates :booth_day, presence: true
  validates :booth_space, presence: true
  validates :genre, presence: true

  has_many :favourites, dependent: :destroy
  has_many :users, through: :favourites
end
