# Stores the visual position of a single booth space on an event's floor plan image.
# Coordinates are percentages of the image dimensions (0–100), so they remain accurate
# regardless of the size at which the image is displayed.
# This is purely positional data — it does not represent attendance (see Booth for that).
class EventMapCoordinate < ApplicationRecord
  belongs_to :event
  belongs_to :event_floor_plan, optional: true
  validates :booth_space, :x, :y, :width, :height, presence: true
  # A booth space can only be mapped once per event
  validates :booth_space, uniqueness: { scope: :event_id }
end
