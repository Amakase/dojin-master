class ChangeColumnDefaultForEventDescription < ActiveRecord::Migration[8.1]
  def change
    change_column_default :events, :description, from: nil, to: ""
  end
end
