class EventMapCoordinate < ApplicationRecord
  belongs_to :event
  validates :booth_space, :x, :y, :width, :height, presence: true
  validates :booth_space, uniqueness: { scope: :event_id }
end
