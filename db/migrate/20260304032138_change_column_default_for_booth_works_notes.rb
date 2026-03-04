class ChangeColumnDefaultForBoothWorksNotes < ActiveRecord::Migration[8.1]
  def change
    change_column_default :booth_works, :notes, from: nil, to: ""
  end
end
