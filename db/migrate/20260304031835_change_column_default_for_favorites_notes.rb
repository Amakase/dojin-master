class ChangeColumnDefaultForFavoritesNotes < ActiveRecord::Migration[8.1]
  def change
    change_column_default :favorites, :notes, from: nil, to: ""
  end
end
