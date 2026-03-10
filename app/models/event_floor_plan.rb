class EventFloorPlan < ApplicationRecord
  belongs_to :event
  has_one_attached :image
  has_many :event_map_coordinates, dependent: :destroy

  validates :name, presence: true
  default_scope { order(:position, :id) }
end
