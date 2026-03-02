class Event < ApplicationRecord
  belongs_to :user

  validates :name, presence: true
  validates :venue, presence: true
  validates :description, presence: true
  validates :start_date, presence: true
  validates :end_date, presence: true

  has_many :booths, dependent: :destroy
end
