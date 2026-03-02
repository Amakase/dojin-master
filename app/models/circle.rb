class Circle < ApplicationRecord
  validates :name, presence: true
  validates :name_reading, presence: true
  validates :description, presence: true

  has_many :booth, dependent: :destroy
end
