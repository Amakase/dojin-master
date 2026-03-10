class AddEventFloorPlanIdToEventMapCoordinates < ActiveRecord::Migration[8.1]
  def change
    add_reference :event_map_coordinates, :event_floor_plan, foreign_key: true, null: true
  end
end
