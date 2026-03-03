class RemoveNotesFromCircles < ActiveRecord::Migration[8.1]
  def change
    remove_column :circles, :notes, :text
  end
end
