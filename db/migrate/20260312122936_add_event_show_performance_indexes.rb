class AddEventShowPerformanceIndexes < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!
  def up
    add_index :favorites, [:user_id, :booth_id],
              name: "index_favorites_on_user_id_and_booth_id",
              if_not_exists: true,
              algorithm: :concurrently
    add_index :favorites, [:user_id, :priority, :booth_id],
              name: "index_favorites_on_user_priority_booth",
              if_not_exists: true,
              algorithm: :concurrently
    add_index :notifications, [:booth_id, :read],
              name: "index_notifications_on_booth_id_and_read",
              if_not_exists: true,
              algorithm: :concurrently
  end
  def down
    remove_index :favorites,
                 name: "index_favorites_on_user_id_and_booth_id",
                 if_exists: true,
                 algorithm: :concurrently
    remove_index :favorites,
                 name: "index_favorites_on_user_priority_booth",
                 if_exists: true,
                 algorithm: :concurrently
    remove_index :notifications,
                 name: "index_notifications_on_booth_id_and_read",
                 if_exists: true,
                 algorithm: :concurrently
  end
end
