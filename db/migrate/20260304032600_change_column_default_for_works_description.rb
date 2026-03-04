class ChangeColumnDefaultForWorksDescription < ActiveRecord::Migration[8.1]
  def change
    change_column_default :works, :description, from: nil, to: ""
  end
end
