class BoothWork < ApplicationRecord
  belongs_to :booth
  has_one_attached :image

  validates :title, presence: true
  validates :circle, presence: true, allow_blank: true
  validates :price, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :new, inclusion: { in: [true, false] }
  validates :limit, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :num_to_buy, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :num_bought, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :notes, presence: true, allow_blank: true

  def new?
    new
  end
end
