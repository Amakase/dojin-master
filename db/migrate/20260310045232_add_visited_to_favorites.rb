class AddVisitedToFavorites < ActiveRecord::Migration[8.1]
  def change
    add_column :favorites, :visited, :boolean, default: false, null: false
  end
end
