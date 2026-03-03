class CreateBookmarkedEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :bookmarked_events do |t|
      t.references :user, null: false, foreign_key: true
      t.references :event, null: false, foreign_key: true

      t.timestamps
    end
  end
end
