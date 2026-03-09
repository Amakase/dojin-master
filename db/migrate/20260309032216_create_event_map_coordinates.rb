class CreateEventMapCoordinates < ActiveRecord::Migration[8.1]
  def change
    create_table :event_map_coordinates do |t|
      t.references :event, null: false, foreign_key: true
      t.string :booth_space, null: false
      t.float :x, null: false
      t.float :y, null: false
      t.float :width, null: false
      t.float :height, null: false

      t.timestamps
    end
    add_index :event_map_coordinates, [:event_id, :booth_space], unique: true
  end
end
