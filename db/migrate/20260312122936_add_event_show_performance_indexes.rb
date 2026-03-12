class AddEventShowPerformanceIndexes < ActiveRecord::Migration[8.1]
  def change
    add_index :favorites, [:user_id, :booth_id], name: "index_favorites_on_user_id_and_booth_id", if_not_exists: true
    add_index :favorites, [:user_id, :priority, :booth_id],
              name: "index_favorites_on_user_priority_booth",
              if_not_exists: true
    add_index :notifications, [:booth_id, :read], name: "index_notifications_on_booth_id_and_read", if_not_exists: true
  end
end
