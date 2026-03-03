class BoothWork < ApplicationRecord
  belongs_to :booth

  validates :title, presence: true
  # validates :circle
  # validates :price
  # validates :limit
  validates :num_to_buy, presence: true
  # validates :num_bought
  validates :notes, allow_blank: true
end
