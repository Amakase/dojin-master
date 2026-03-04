class ChangeColumnDefaultForNotificationsRead < ActiveRecord::Migration[8.1]
  def change
    change_column_default :notifications, :read, from: nil, to: false
  end
end
