class AddWallRectsToEvents < ActiveRecord::Migration[8.1]
  def change
    add_column :events, :wall_rects, :jsonb
  end
end
