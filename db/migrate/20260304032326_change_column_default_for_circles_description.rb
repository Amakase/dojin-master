class ChangeColumnDefaultForCirclesDescription < ActiveRecord::Migration[8.1]
  def change
    change_column_default :circles, :description, from: nil, to: ""
  end
end
