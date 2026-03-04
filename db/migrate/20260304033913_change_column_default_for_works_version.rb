class ChangeColumnDefaultForWorksVersion < ActiveRecord::Migration[8.1]
  def change
    change_column_default :works, :version, from: nil, to: ""
  end
end
