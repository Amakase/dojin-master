class CreateEventFloorPlans < ActiveRecord::Migration[8.1]
  def change
    create_table :event_floor_plans do |t|
      t.references :event, null: false, foreign_key: true
      t.string  :name,                 null: false
      t.integer :position,             null: false, default: 0
      t.string  :ai_placement_status   # nil | "pending" | "running" | "done" | "failed"
      t.text    :ai_placement_error
      t.timestamps
    end
    add_index :event_floor_plans, [:event_id, :position]
  end
end
